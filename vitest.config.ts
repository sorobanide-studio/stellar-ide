import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root (this config lives at the repo root).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" -> "./*" path mapping.
    alias: [{ find: /^@\//, replacement: `${rootDir}/` }],
  },
  test: {
    // React hook/context tests need document + localStorage.
    environment: 'jsdom',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'stellar-lsp-server/tests/**/*.test.ts',
    ],
  },
});
