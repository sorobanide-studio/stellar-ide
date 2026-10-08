import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  ]),
]);

export default eslintConfig;
