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
      expect(screen.getByText(/エラーが発生しました:/)).toBeInTheDocument();
      expect(screen.getByText(/Network error occurred/)).toBeInTheDocument();
    });

    it("should have destructive styling for error alerts", () => {
      render(<ResultDisplay result={null} error="Test error" />);

      const alert = screen.getByRole("alert");
      expect(alert.className).toContain("bg-red-950");
      expect(alert.className).toContain("border-red-800");
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
      expect(
        screen.getByText(/フィードが見つかりませんでした/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/https:\/\/example.com からRSS\/Atomフィードを発見/),
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

      expect(
        screen.getByText(/フィードが見つかりませんでした/),
      ).toBeInTheDocument();
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

      expect(
        screen.getByText(/2個のフィードが見つかりました/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/検索対象: https:\/\/example.com/),
      ).toBeInTheDocument();
    });

    it("should render all feed cards", () => {
      render(<ResultDisplay result={successResult} />);

      expect(screen.getByText("Example RSS Feed")).toBeInTheDocument();
      expect(screen.getByText("Example Atom Feed")).toBeInTheDocument();
    });

    it("should display feed type badges correctly", () => {
      render(<ResultDisplay result={successResult} />);

      const rssBadge = screen.getByText("RSS");
      const atomBadge = screen.getByText("Atom");

      expect(rssBadge.className).toContain("bg-orange-900");
      expect(atomBadge.className).toContain("bg-blue-900");
    });

    it("should display discovery method correctly", () => {
      render(<ResultDisplay result={successResult} />);

      expect(screen.getByText("HTML メタタグから発見")).toBeInTheDocument();
      expect(screen.getByText("一般的なパスから発見")).toBeInTheDocument();
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
      expect(section).toHaveAttribute("aria-label", "検索結果");
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
        screen.getByLabelText(/Example Feedのフィードを新しいタブで開く/),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Example FeedのURLをクリップボードにコピー/),
      ).toBeInTheDocument();
    });

    it("should have group role on action buttons", () => {
      render(<ResultDisplay result={successResult} />);

      const group = screen.getByRole("group", { name: "フィードアクション" });
      expect(group).toBeInTheDocument();
    });

    it("should have aria-live on status messages", () => {
      render(<ResultDisplay result={successResult} />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("URL copy functionality", () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      Object.assign(navigator, { clipboard: mockClipboard });
      mockClipboard.writeText.mockClear();
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
        /Example FeedのURLをクリップボードにコピー/,
      );
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
      );
    });

    it("should show copied state after successful copy", async () => {
      vi.useFakeTimers();
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Example FeedのURLをクリップボードにコピー/,
      );
      fireEvent.click(copyButton);

      await vi.waitFor(() => {
        expect(screen.getByText("コピー済み")).toBeInTheDocument();
      });

      expect(copyButton.className).toContain("bg-green-900");

      vi.advanceTimersByTime(2000);

      await vi.waitFor(() => {
        expect(screen.getByText("URLをコピー")).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("should handle keyboard activation for copy button", () => {
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Example FeedのURLをクリップボードにコピー/,
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
        /Example Feedのフィードを新しいタブで開く/,
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
        /Example Feedのフィードを新しいタブで開く/,
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
        /Example Feedのフィードを新しいタブで開く/,
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
