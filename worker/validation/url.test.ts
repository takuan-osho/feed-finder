import { describe, expect, it } from "vitest";

import { expandIpv6, safeCreateUrl, validateTargetUrl } from "./url";

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

  describe("expandIpv6", () => {
    it.each([
      ["::", [0, 0, 0, 0, 0, 0, 0, 0]],
      ["::1", [0, 0, 0, 0, 0, 0, 0, 1]],
      ["1::", [1, 0, 0, 0, 0, 0, 0, 0]],
      ["fe80::1:2", [0xfe80, 0, 0, 0, 0, 0, 1, 2]],
      ["1:2:3:4:5:6:7:8", [1, 2, 3, 4, 5, 6, 7, 8]],
      ["1:2:3:4:5:6:7::", [1, 2, 3, 4, 5, 6, 7, 0]],
      ["::ffff:127.0.0.1", [0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]],
      ["::1.2.3.4", [0, 0, 0, 0, 0, 0, 0x0102, 0x0304]],
      ["1:2:3:4:5:6:1.2.3.4", [1, 2, 3, 4, 5, 6, 0x0102, 0x0304]],
    ])("should expand %s", (input, expected) => {
      expect(expandIpv6(input)).toEqual(expected);
    });

    it.each([
      "",
      "1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:8:9",
      "1::2::3",
      "1:2:3:4::5:6:7:8",
      "12345::",
      "g::1",
      "::1.2.3.256",
      "::1.2.3",
      "1.2.3.4",
      "1:2:3:4:5:6:7:1.2.3.4",
    ])("should return null for unparsable address %s", (input) => {
      expect(expandIpv6(input)).toBeNull();
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

    describe("SSRF gap coverage", () => {
      const expectBlocked = (url: string, message?: string) => {
        const result = validateTargetUrl(url);
        expect(result.isErr(), url).toBe(true);
        if (result.isErr()) {
          expect(result.error.type, url).toBe("URL_NOT_PERMITTED");
          if (message) {
            expect(result.error.message, url).toBe(message);
          }
        }
      };

      const expectAllowed = (url: string) => {
        expect(validateTargetUrl(url).isOk(), url).toBe(true);
      };

      describe("localhost and internal hostnames", () => {
        it.each([
          "http://localhost./",
          "http://LOCALHOST./",
          "http://foo.localhost/",
          "http://a.b.localhost./",
        ])("should block %s as localhost", (url) => {
          expectBlocked(url, "Access to localhost is not permitted");
        });

        it.each([
          "http://printer.local/",
          "http://printer.local./",
          "http://metadata.google.internal/",
          "http://metadata.google.internal./",
          "http://service.INTERNAL/",
        ])("should block internal-only hostname %s", (url) => {
          expectBlocked(url, "Access to internal hostnames is not permitted");
        });

        it.each([
          "http://example.com./",
          "http://local.example.com/",
          "http://internal.example.com/",
          "http://localhost.example.com/",
          "http://mylocal/",
        ])("should still allow public hostname %s", (url) => {
          expectAllowed(url);
        });
      });

      describe("IPv4 ranges", () => {
        it.each([
          "http://0.0.0.0/",
          "http://0.255.255.255/",
          "http://100.64.0.0/",
          "http://100.127.255.255/",
          "http://192.0.0.1/",
          "http://192.0.0.255/",
          "http://198.18.0.1/",
          "http://198.19.255.255/",
          "http://224.0.0.1/",
          "http://239.255.255.255/",
          "http://240.0.0.1/",
          "http://255.255.255.255/",
        ])("should block reserved IPv4 address %s", (url) => {
          expectBlocked(url, "Access to private IP addresses is not permitted");
        });

        it.each([
          "http://2130706433/",
          "http://0x7f.1/",
          "http://127.1/",
          "http://0177.0.0.1/",
        ])("should block normalized loopback form %s", (url) => {
          expectBlocked(url, "Access to localhost is not permitted");
        });

        it.each([
          "http://0xa9fea9fe/",
          "http://169.254.169.254./",
          "http://0/",
        ])("should block obfuscated private address %s", (url) => {
          expectBlocked(url);
        });

        it.each([
          "http://8.8.8.8/",
          "http://172.32.0.1/",
          "http://172.15.255.255/",
          "http://100.128.0.1/",
          "http://100.63.255.255/",
          "http://192.0.1.1/",
          "http://198.17.255.255/",
          "http://198.20.0.1/",
          "http://223.255.255.255/",
          "http://11.0.0.1/",
          "http://1.1.1.1/",
        ])("should still allow public IPv4 address %s", (url) => {
          expectAllowed(url);
        });
      });

      describe("IPv6 literals", () => {
        it.each(["http://[::]/", "http://[0:0:0:0:0:0:0:0]/"])(
          "should block unspecified address %s",
          (url) => {
            expectBlocked(
              url,
              "Access to private IP addresses is not permitted",
            );
          },
        );

        it.each(["http://[::1]/", "http://[0:0:0:0:0:0:0:1]/"])(
          "should block loopback address %s",
          (url) => {
            expectBlocked(url, "Access to localhost is not permitted");
          },
        );

        it.each([
          "http://[fc00::1]/",
          "http://[fd12:3456:789a::1]/",
          "http://[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]/",
          "http://[fe80::1]/",
          "http://[febf::1]/",
          "http://[ff02::1]/",
          "http://[ff00::]/",
          "http://[::ffff:127.0.0.1]/",
          "http://[::ffff:7f00:1]/",
          "http://[::ffff:8.8.8.8]/",
          "http://[64:ff9b::a9fe:a9fe]/",
          "http://[64:ff9b::8.8.8.8]/",
          "http://[2002:7f00:1::]/",
          "http://[2002::1]/",
        ])("should block non-public IPv6 address %s", (url) => {
          expectBlocked(url, "Access to private IP addresses is not permitted");
        });

        it.each([
          "http://[2606:4700:4700::1111]/",
          "http://[2001:4860:4860::8888]/",
          "http://[fbff::1]/",
          "http://[fec0::1]/",
          "http://[2003::1]/",
          "http://[64:ff9c::1]/",
        ])("should still allow public IPv6 address %s", (url) => {
          expectAllowed(url);
        });
      });

      describe("credentials in URL", () => {
        it.each([
          "https://user:pass@example.com/",
          "https://user@example.com/",
          "https://:pass@example.com/",
        ])("should reject URL with credentials %s", (url) => {
          expectBlocked(url, "URLs with credentials are not permitted");
        });
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
