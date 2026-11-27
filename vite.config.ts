/// <reference types="vitest" />
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Formatter (Oxfmt). Defaults match the previous Biome setup:
  // 2-space indent, double quotes, trailing commas. Keep 80 columns (Oxfmt defaults to 100).
  fmt: {
    printWidth: 80,
    sortImports: true,
    ignorePatterns: [".cloudflare/**", "dist/**", "coverage/**"],
  },
  // Linter (Oxlint). Only the rules below are enabled (the default
  // "correctness" category is off), mirroring the hand-picked rules from the
  // previous biome.json. Biome noDuplicateParameters has no Oxlint rule; the
  // TypeScript compiler already rejects duplicate parameters.
  lint: {
    categories: { correctness: "off" },
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "react"],
    env: { browser: true, es2024: true },
    ignorePatterns: [".cloudflare/**", "dist/**", "coverage/**"],
    rules: {
      // Biome: complexity
      "no-regex-spaces": "error",
      "prefer-rest-params": "error",
      "no-extra-boolean-cast": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "typescript/no-this-alias": "error",
      "typescript/no-unnecessary-type-constraint": "error",
      // Biome: correctness
      "no-const-assign": "error",
      "no-constant-condition": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-obj-calls": "error",
      "no-new-native-nonconstructor": "error",
      "no-new-wrappers": "error",
      "constructor-super": "error",
      "no-nonoctal-decimal-escape": "error",
      "no-loss-of-precision": "error",
      "no-self-assign": "error",
      "no-setter-return": "error",
      "no-case-declarations": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-this-before-super": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-optional-chaining": "error",
      "no-unused-labels": "error",
      "no-unused-private-class-members": "error",
      "no-unused-vars": "error",
      "react/exhaustive-deps": "warn",
      "react/rules-of-hooks": "error",
      "use-isnan": "error",
      "for-direction": "error",
      "valid-typeof": "error",
      "require-yield": "error",
      // Biome: style
      "import/no-commonjs": "error",
      "typescript/no-namespace": "error",
      "no-array-constructor": "error",
      "typescript/prefer-as-const": "error",
      "react/only-export-components": "error",
      "prefer-const": "error",
      // Biome: suspicious
      "no-cond-assign": "error",
      "no-async-promise-executor": "error",
      "no-ex-assign": "error",
      "no-class-assign": "error",
      "no-compare-neg-zero": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
      "no-control-regex": "error",
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-dupe-class-members": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-empty": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-extra-non-null-assertion": "error",
      "no-fallthrough": "error",
      "no-func-assign": "error",
      "no-global-assign": "error",
      "no-import-assign": "error",
      "no-irregular-whitespace": "error",
      "no-misleading-character-class": "error",
      "typescript/no-misused-new": "error",
      "no-prototype-builtins": "error",
      "no-redeclare": "error",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "typescript/no-unsafe-declaration-merging": "error",
      "no-unsafe-negation": "error",
      "no-var": "error",
      "no-with": "error",
      "getter-return": "error",
      "typescript/prefer-namespace-keyword": "error",
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
      treeshake: {
        manualPureFunctions: ["console.info", "console.debug"],
      },
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
