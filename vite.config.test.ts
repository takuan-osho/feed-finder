// @vitest-environment node

import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("vite config", () => {
  it("does not mark console.log as pure because Worker access logs use it", () => {
    const pureFunctions =
      config.build?.rollupOptions?.treeshake &&
      typeof config.build.rollupOptions.treeshake === "object" &&
      "manualPureFunctions" in config.build.rollupOptions.treeshake
        ? config.build.rollupOptions.treeshake.manualPureFunctions
        : [];

    expect(pureFunctions).not.toContain("console.log");
    expect(pureFunctions).toEqual(
      expect.arrayContaining(["console.info", "console.debug"]),
    );
  });
});
