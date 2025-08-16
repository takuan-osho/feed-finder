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

      const input = screen.getByLabelText(/ウェブサイトのURL/);

      fireEvent.change(input, { target: { value: "http://" } });
      fireEvent.submit(input.closest("form")!);

      // Should show validation error
      await waitFor(() => {
        const errorElement = screen.queryByText(/有効なURLを入力してください/);
        expect(errorElement).toBeTruthy();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should reject https:// as invalid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/ウェブサイトのURL/);

      fireEvent.change(input, { target: { value: "https://" } });
      fireEvent.submit(input.closest("form")!);

      // Should show validation error
      await waitFor(() => {
        const errorElement = screen.queryByText(/有効なURLを入力してください/);
        expect(errorElement).toBeTruthy();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should accept example.com as valid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/ウェブサイトのURL/);

      fireEvent.change(input, { target: { value: "example.com" } });
      fireEvent.submit(input.closest("form")!);

      // Should not show validation error
      expect(screen.queryByText(/有効なURLを入力してください/)).toBeNull();

      // Should call onSubmit with normalized URL
      expect(mockOnSubmit).toHaveBeenCalledWith("https://example.com");
    });

    it("should accept example.technology (long TLD) as valid URL", async () => {
      render(<SearchForm onSubmit={mockOnSubmit} isLoading={false} />);

      const input = screen.getByLabelText(/ウェブサイトのURL/);

      fireEvent.change(input, { target: { value: "example.technology" } });
      fireEvent.submit(input.closest("form")!);

      // Should not show validation error
      expect(screen.queryByText(/有効なURLを入力してください/)).toBeNull();

      // Should call onSubmit with normalized URL
      expect(mockOnSubmit).toHaveBeenCalledWith("https://example.technology");
    });
  });
});
