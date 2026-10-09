import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the tsconfig `@/*` path alias for vitest so the tests (and the
// modules they import) can use `@/...` specifiers. Without this, loading a
// test that imports `@/lib/...` fails with "Failed to load url".
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
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
