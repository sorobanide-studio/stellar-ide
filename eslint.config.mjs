import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The directories that make up the root project's lint surface. Keep this list in
// sync with the paths passed to `eslint` by the `lint` script in package.json.
const sourceFiles = [
  "app/**/*.{js,jsx,ts,tsx,mjs}",
  "components/**/*.{js,jsx,ts,tsx,mjs}",
  "context/**/*.{js,jsx,ts,tsx,mjs}",
  "hooks/**/*.{js,jsx,ts,tsx,mjs}",
  "lib/**/*.{js,jsx,ts,tsx,mjs}",
  "tests/**/*.{js,jsx,ts,tsx,mjs}",
];

const eslintConfig = defineConfig([
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts that must never be linted as source:
    "coverage/**",
    "tsconfig.tsbuildinfo",
    // Archived hooks are kept for reference only, not as active source.
    "hooks/archived/**",
    // The language server is a separate TypeScript project with its own tsconfig
    // and build output (stellar-lsp-server/dist) and is linted on its own.
    "stellar-lsp-server/**",
  ]),
  // Restrict the config to the intended source surface so a generated file can
  // never be linted by accident.
  {
    files: sourceFiles,
  },
  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;
