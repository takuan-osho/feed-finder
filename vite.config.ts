/// <reference types="vitest" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

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
    // Bundle size optimization
    minify: "terser",
    terserOptions: {
      compress: {
        // Only remove console.log, console.info, and console.debug in production
        drop_debugger: true,
        pure_funcs: [
          "console.log",
          "console.info",
          "console.debug",
        ],
      },
    },
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor dependencies
          react: ["react", "react-dom"],
          ui: [
            "@radix-ui/react-slot",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
          icons: ["lucide-react"],
        },
        // Optimize chunk file names
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // Target ES2020 for better compression
    target: "es2020",
    // Ensure consistent chunk hashes
    cssCodeSplit: true,
  },
});
