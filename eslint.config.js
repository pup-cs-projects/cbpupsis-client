// ESLint finds bugs; Prettier owns formatting. eslint-config-prettier comes last
// so no stylistic rule can disagree with the formatter.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const rules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

export default defineConfig([
  globalIgnores(["**/dist", "**/coverage", "packages/shared/src/api/schema.gen.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["packages/shared/**"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // WCAG 2.1 AA is a requirement (SRS 4.3), so accessibility findings are errors.
      jsxA11y.flatConfigs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules,
  },
  {
    // The same rules minus React: nothing in shared may import a framework, so every app can
    // use it without a second copy of React in its bundle. React code goes in packages/ui.
    files: ["packages/shared/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      ...rules,
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-*", "@tanstack/*"], message: "shared stays framework-free" },
          ],
        },
      ],
    },
  },
]);
