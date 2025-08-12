import { describe, expect, it } from "vitest";
import { safeCreateUrl, validateTargetUrl } from "./url";

describe("validation/url", () => {
  describe("safeCreateUrl", () => {
    it("should successfully create URL from valid string", () => {
      const result = safeCreateUrl("https://example.com");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.href).toBe("https://example.com/");
      }
    });

    it("should fail for invalid URL string", () => {
      const result = safeCreateUrl("invalid-url");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_URL_FORMAT");
        expect(result.error.message).toBe("Invalid URL format");
      }
    });

    it("should fail for empty string", () => {
      const result = safeCreateUrl("");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("INVALID_URL_FORMAT");
      }
    });
  });

  describe("validateTargetUrl", () => {
    describe("valid URLs", () => {
      it("should allow HTTPS URLs", () => {
        const result = validateTargetUrl("https://example.com");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.protocol).toBe("https:");
          expect(result.value.hostname).toBe("example.com");
        }
      });

      it("should allow HTTP URLs", () => {
        const result = validateTargetUrl("http://example.com");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.protocol).toBe("http:");
        }
      });

      it("should allow standard ports", () => {
        expect(validateTargetUrl("http://example.com:80").isOk()).toBe(true);
        expect(validateTargetUrl("https://example.com:443").isOk()).toBe(true);
        expect(validateTargetUrl("http://example.com:8080").isOk()).toBe(true);
        expect(validateTargetUrl("https://example.com:8443").isOk()).toBe(true);
      });
    });

    describe("invalid protocols", () => {
      it("should reject FTP protocol", () => {
        const result = validateTargetUrl("ftp://example.com");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toBe(
            "Only HTTP/HTTPS protocols are supported",
          );
        }
      });

      it("should reject file protocol", () => {
        const result = validateTargetUrl("file:///etc/passwd");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
        }
      });
    });

    describe("localhost and loopback blocking", () => {
      it("should block localhost hostname", () => {
        const result = validateTargetUrl("http://localhost");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toBe(
            "Access to localhost is not permitted",
          );
        }
      });

      it("should block 127.x.x.x addresses", () => {
        const addresses = [
          "http://127.0.0.1",
          "http://127.1.1.1",
          "http://127.255.255.255",
        ];

        addresses.forEach((address) => {
          const result = validateTargetUrl(address);
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.error.type).toBe("URL_NOT_PERMITTED");
            expect(result.error.message).toBe(
              "Access to localhost is not permitted",
            );
          }
        });
      });

      it("should block IPv6 loopback addresses", () => {
        const addresses = [
          "http://[::1]",
          "http://[0:0:0:0:0:0:0:1]",
          "http://[0000:0000:0000:0000:0000:0000:0000:0001]",
        ];

        addresses.forEach((address) => {
          const result = validateTargetUrl(address);
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            // Some IPv6 formats might fail at URL parsing level
            expect(["URL_NOT_PERMITTED", "INVALID_URL_FORMAT"]).toContain(
              result.error.type,
            );
            if (result.error.type === "URL_NOT_PERMITTED") {
              expect(result.error.message).toBe(
                "Access to localhost is not permitted",
              );
            }
          }
        });
      });
    });

    describe("private IP address blocking", () => {
      it("should block 10.x.x.x addresses", () => {
        const addresses = [
          "http://10.0.0.1",
          "http://10.1.1.1",
          "http://10.255.255.255",
        ];

        addresses.forEach((address) => {
          const result = validateTargetUrl(address);
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.error.type).toBe("URL_NOT_PERMITTED");
            expect(result.error.message).toBe(
              "Access to private IP addresses is not permitted",
            );
          }
        });
      });

      it("should block 172.16-31.x.x addresses", () => {
        const addresses = [
          "http://172.16.0.1",
          "http://172.20.1.1",
          "http://172.31.255.255",
        ];

        addresses.forEach((address) => {
          const result = validateTargetUrl(address);
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.error.type).toBe("URL_NOT_PERMITTED");
            expect(result.error.message).toBe(
              "Access to private IP addresses is not permitted",
            );
          }
        });
      });

      it("should block 192.168.x.x addresses", () => {
        const result = validateTargetUrl("http://192.168.1.1");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toBe(
            "Access to private IP addresses is not permitted",
          );
        }
      });

      it("should block 169.254.x.x (link-local/metadata) addresses", () => {
        const result = validateTargetUrl("http://169.254.169.254");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
          expect(result.error.message).toBe(
            "Access to private IP addresses is not permitted",
          );
        }
      });

      it("should block IPv6 private addresses", () => {
        const result = validateTargetUrl("http://[fc00::1]");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          // IPv6 private addresses should be blocked, but some formats might fail at parsing
          expect(["URL_NOT_PERMITTED", "INVALID_URL_FORMAT"]).toContain(
            result.error.type,
          );
          if (result.error.type === "URL_NOT_PERMITTED") {
            expect(result.error.message).toBe(
              "Access to private IP addresses is not permitted",
            );
          }
        }
      });
    });

    describe("port restrictions", () => {
      it("should block uncommon ports", () => {
        const ports = ["22", "23", "25", "53", "110", "143", "993", "995"];

        ports.forEach((port) => {
          const result = validateTargetUrl(`http://example.com:${port}`);
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.error.type).toBe("URL_NOT_PERMITTED");
            expect(result.error.message).toBe(
              "Access to this port is not permitted",
            );
          }
        });
      });

      it("should allow no explicit port (default ports)", () => {
        expect(validateTargetUrl("http://example.com").isOk()).toBe(true);
        expect(validateTargetUrl("https://example.com").isOk()).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle case-insensitive hostnames", () => {
        const result = validateTargetUrl("http://LOCALHOST");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("URL_NOT_PERMITTED");
        }
      });

      it("should handle invalid URL format", () => {
        const result = validateTargetUrl("not-a-url");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("INVALID_URL_FORMAT");
          expect(result.error.message).toBe("Invalid URL format");
        }
      });
    });
  });
});
