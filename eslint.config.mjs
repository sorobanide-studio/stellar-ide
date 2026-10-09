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
  ...nextVitals,
  ...nextTs,
  // The editor keeps a little state on `window` (see the `Window` interface in
  // components/Editor/types.ts). That registry is invisible to the compiler, so
  // without a rule a fourteenth global can appear in any review-unnoticed pull
  // request. Ban new assignments to a `window` property in the root project's
  // source; reads such as `window.location` and `window.innerHeight` are not
  // assignments and are unaffected. The three existing writes are allowlisted
  // in place with an `eslint-disable-next-line` explaining the follow-up.
  {
    files: [
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "AssignmentExpression[left.object.name='window']",
          message:
            "Do not write to a `window` global. Keep this state in React context and read it through a provider; if an exception is genuinely needed, add `// eslint-disable-next-line no-restricted-syntax -- <reason>` next to it.",
        },
        {
          selector:
            "AssignmentExpression[left.object.type='TSAsExpression'][left.object.expression.name='window']",
          message:
            "Do not write to a `window` global through a cast. Keep this state in React context instead.",
        },
      ],
    },
  },
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
