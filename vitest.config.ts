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
