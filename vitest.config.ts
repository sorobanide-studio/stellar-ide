import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * `npm test` runs `vitest run`; without this file Vite does not know about the
 * `@/*` -> repo-root alias declared in tsconfig.json, so any test importing
 * `@/lib/...` (including the existing tests/lib/wallet-deploy.test.ts) fails to
 * collect. The alias is resolved from this file's location to an absolute path
 * so it behaves the same as the tsconfig.json `paths` entry.
 */
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
