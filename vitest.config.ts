import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import devBundle from "./src/data/curated/dev-bundle.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  define: {
    __RUNTIME_BUNDLE__: JSON.stringify(devBundle),
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "tests/architecture/**/*.test.{ts,tsx}",
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
      "tests/security/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 75,
        lines: 80,
      },
    },
  },
});
