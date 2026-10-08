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
