import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "prisma.config.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.cts", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error"
    }
  }
);
