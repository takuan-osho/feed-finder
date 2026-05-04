import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

describe("SearchForm URL Validation", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("URL API based validation", () => {
    it("should reject http:// as invalid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "http://" } });
      fireEvent.submit(input.closest("form")!);

      // Should show validation error
      await waitFor(() => {
        const errorElement = screen.queryByText(/Please enter a valid URL/);
        expect(errorElement).toBeTruthy();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should reject https:// as invalid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "https://" } });
      fireEvent.submit(input.closest("form")!);

      // Should show validation error
      await waitFor(() => {
        const errorElement = screen.queryByText(/Please enter a valid URL/);
        expect(errorElement).toBeTruthy();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should accept example.com as valid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.submit(input.closest("form")!);

      // Should not show validation error
      expect(screen.queryByText(/Please enter a valid URL/)).toBeNull();

      // Should call onSubmit with normalized URL
      expect(mockOnSubmit).toHaveBeenCalledWith("https://example.com");
    });

    it("should not use native URL input validation", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("inputmode", "url");
      expect(input).toHaveAttribute("autocomplete", "url");
    });

    it("should accept example.technology (long TLD) as valid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "example.technology" } });
      fireEvent.submit(input.closest("form")!);

      // Should not show validation error
      expect(screen.queryByText(/Please enter a valid URL/)).toBeNull();

      // Should call onSubmit with normalized URL
      expect(mockOnSubmit).toHaveBeenCalledWith("https://example.technology");
    });
  });

  describe("keyboard handling", () => {
    it("should not submit directly from repeated URL input keydown events", () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter", repeat: true });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should leave IME composition Enter to native input handling", () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.keyDown(input, { isComposing: true, key: "Enter" });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should not submit directly from repeated submit button Enter keydown events", () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);
      const button = screen.getByRole("button", {
        name: "Search feeds for the entered URL",
      });

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.keyDown(button, { key: "Enter" });
      fireEvent.keyDown(button, { key: "Enter", repeat: true });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should not submit directly from repeated submit button Space keydown events", () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);
      const button = screen.getByRole("button", {
        name: "Search feeds for the entered URL",
      });

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.keyDown(button, { key: " " });
      fireEvent.keyDown(button, { key: " ", repeat: true });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should leave submit button IME composition Enter to native button handling", () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/Website URL/);
      const button = screen.getByRole("button", {
        name: "Search feeds for the entered URL",
      });

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.keyDown(button, { isComposing: true, key: "Enter" });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
