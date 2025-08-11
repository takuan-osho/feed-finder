import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse } from "./errors";

describe("http/errors", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    mathRandomSpy.mockRestore();
  });

  describe("createErrorResponse", () => {
    it("should handle INVALID_REQUEST_BODY error", async () => {
      const error = {
        type: "INVALID_REQUEST_BODY" as const,
        message: "Request body is invalid",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(400);

      const responseData = (await response.json()) as any;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe(
        "Invalid request. Please check your input and try again.",
      );
      expect(typeof responseData.errorId).toBe("string");
      expect(responseData.errorId.length).toBeGreaterThan(0);
    });

    it("should handle MISSING_URL error", async () => {
      const error = {
        type: "MISSING_URL" as const,
        message: "URL is required",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(400);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "Invalid request. Please check your input and try again.",
      );
    });

    it("should handle INVALID_URL_FORMAT error", async () => {
      const error = {
        type: "INVALID_URL_FORMAT" as const,
        message: "URL format is invalid",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
    });

    it("should handle URL_NOT_PERMITTED error", async () => {
      const error = {
        type: "URL_NOT_PERMITTED" as const,
        message: "Access to this URL is not permitted",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
    });

    it("should handle FETCH_FAILED error", async () => {
      const error = {
        type: "FETCH_FAILED" as const,
        message: "HTTP 500",
        status: 500,
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(502);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "Unable to access the requested URL. Please try again later.",
      );
    });

    it("should handle FETCH_FAILED with 404 status", async () => {
      const error = {
        type: "FETCH_FAILED" as const,
        message: "HTTP 404",
        status: 404,
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(404);
    });

    it("should handle NETWORK_ERROR", async () => {
      const error = {
        type: "NETWORK_ERROR" as const,
        message: "Connection failed",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(500);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "Unable to access the requested URL. Please try again later.",
      );
    });

    it("should handle TIMEOUT_ERROR", async () => {
      const error = {
        type: "TIMEOUT_ERROR" as const,
        message: "Request timed out",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(408);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "Unable to access the requested URL. Please try again later.",
      );
    });

    it("should handle PARSING_ERROR", async () => {
      const error = {
        type: "PARSING_ERROR" as const,
        message: "Failed to parse response",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(500);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "Unable to analyze the website content. Please try a different URL.",
      );
    });

    it("should handle unknown error types", async () => {
      const error = {
        type: "UNKNOWN_ERROR" as any,
        message: "Something went wrong",
      };

      const response = createErrorResponse(error);

      expect(response.status).toBe(500);

      const responseData = (await response.json()) as any;
      expect(responseData.error).toBe(
        "An unexpected error occurred. Please try again later.",
      );
    });

    it("should log error details with generated ID", () => {
      const error = {
        type: "NETWORK_ERROR" as const,
        message: "Connection refused",
      };

      createErrorResponse(error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toMatch(
        /^\[\w+\] Error type: NETWORK_ERROR, Details: Connection refused$/,
      );
    });

    it("should generate unique error IDs", () => {
      mathRandomSpy.mockRestore(); // Use real Math.random for this test

      const error = {
        type: "NETWORK_ERROR" as const,
        message: "Test error",
      };

      const response1 = createErrorResponse(error);
      const response2 = createErrorResponse(error);

      // Extract error IDs from responses
      const getErrorId = async (response: Response) => {
        const data = await response.clone().json();
        return data.errorId;
      };

      // Error IDs should be different (though this is probabilistic)
      Promise.all([getErrorId(response1), getErrorId(response2)]).then(
        ([id1, id2]) => {
          expect(id1).not.toBe(id2);
        },
      );
    });

    it("should return JSON response with correct structure", async () => {
      const error = {
        type: "NETWORK_ERROR" as const,
        message: "Test error",
      };

      const response = createErrorResponse(error);

      expect(response.headers.get("Content-Type")).toContain(
        "application/json",
      );

      const responseData = (await response.json()) as any;
      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData).toHaveProperty("errorId");
      expect(typeof responseData.errorId).toBe("string");
    });
  });
});
