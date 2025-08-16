import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["**/*.{test,spec}.{js,ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
