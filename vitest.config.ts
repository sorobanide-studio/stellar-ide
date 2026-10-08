import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest does not read the "@/*" alias from tsconfig.json, so mirror it here.
// The DOM environment is scoped to the component tests that need it.
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
  },
});
