/// <reference types="vitest" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["**/*.{test,spec}.{js,ts,tsx}"],
  },
  build: {
    minify: "oxc",
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separate vendor dependencies
          if (id.includes("node_modules/react")) {
            return "react";
          }

          if (
            id.includes("node_modules/@radix-ui/react-slot") ||
            id.includes("node_modules/class-variance-authority") ||
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/tailwind-merge")
          ) {
            return "ui";
          }

          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

          return undefined;
        },
        // Optimize chunk file names
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // Ensure consistent chunk hashes
    cssCodeSplit: true,
  },
});
