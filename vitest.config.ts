import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root (this config lives at the repo root).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" -> "./*" path mapping. The route under test
    // imports "@/lib/docker" and "@/lib/projects", so the alias must resolve.
    alias: [{ find: /^@\//, replacement: `${rootDir}/` }],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
