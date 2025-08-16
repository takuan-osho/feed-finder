import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["**/*.{test,spec}.{js,ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
