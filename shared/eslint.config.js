// The same rules as the apps, minus React: nothing in this package may import a framework,
// so every app can use it without a second copy of React in its bundle.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["coverage", "src/api/schema.gen.ts"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
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
