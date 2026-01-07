import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { resolve } from "node:path";

/*
 * This is a custom ESLint configuration for use with
 * TypeScript CLI packages in the monorepo.
 *
 * CLI packages run in Node.js and need access to Node.js globals
 * like process, Buffer, console, etc.
 *
 * Uses modern ESLint flat config format (ESLint 9+).
 */

/**
 * Create a CLI-specific TypeScript ESLint configuration
 * @param {string} [tsconfigPath='./tsconfig.json'] - Path to tsconfig.json
 * @returns {Array} ESLint flat config array
 */
export default function createCliConfig(tsconfigPath = "./tsconfig.json") {
  const project = resolve(process.cwd(), tsconfigPath);

  return [
    js.configs.recommended,
    // Source code rules - CLI-specific settings
    {
      files: ["src/**/*.ts", "**/*.tsx"],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: "module",
          project,
        },
        globals: {
          // Node.js globals for CLI
          process: "readonly",
          Buffer: "readonly",
          console: "readonly",
          __dirname: "readonly",
          __filename: "readonly",
          // Common globals
          TextEncoder: "readonly",
          TextDecoder: "readonly",
          btoa: "readonly",
          atob: "readonly",
          setTimeout: "readonly",
          clearTimeout: "readonly",
          setInterval: "readonly",
          clearInterval: "readonly",
        },
      },
      plugins: {
        "@typescript-eslint": tsPlugin,
      },
      rules: {
        // Use TypeScript rules but relaxed for CLI code
        ...tsPlugin.configs["recommended-type-checked"].rules,
        ...tsPlugin.configs["stylistic-type-checked"].rules,

        // Type safety - keep most but relax some for CLI
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-return": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/strict-boolean-expressions": [
          "error",
          {
            allowString: true, // CLIs often check string truthiness
            allowNumber: false,
            allowNullableObject: true,
            allowNullableString: true,
          },
        ],
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/no-non-null-assertion": "warn", // Relaxed for CLI

        // Code quality
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            prefer: "type-imports",
            fixStyle: "inline-type-imports",
          },
        ],
        "@typescript-eslint/consistent-type-exports": [
          "error",
          {
            fixMixedExportsWithInlineTypeSpecifier: true,
          },
        ],
        "@typescript-eslint/explicit-function-return-type": [
          "error",
          {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
            allowHigherOrderFunctions: true,
          },
        ],
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/no-redundant-type-constituents": "error",

        // CLI-specific: Allow Node.js globals and console
        "no-console": "off",
        "no-restricted-globals": "off",
        "no-restricted-syntax": "off",

        // Best practices
        "no-var": "error",
        "prefer-const": "error",
        "prefer-arrow-callback": "error",
        "prefer-template": "error",
        "no-throw-literal": "error",
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/prefer-reduce-type-parameter": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/no-namespace": "off",
      },
      settings: {
        "import/resolver": {
          typescript: {
            project,
          },
        },
      },
    },
    // Test file rules - relaxed for testing
    {
      files: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: "module",
          project,
        },
        globals: {
          // Jest/Vitest globals
          describe: "readonly",
          test: "readonly",
          it: "readonly",
          expect: "readonly",
          beforeEach: "readonly",
          afterEach: "readonly",
          beforeAll: "readonly",
          afterAll: "readonly",
          jest: "readonly",
          vi: "readonly",
          // Node.js globals
          process: "readonly",
          Buffer: "readonly",
          console: "readonly",
          TextEncoder: "readonly",
          TextDecoder: "readonly",
        },
      },
      plugins: {
        "@typescript-eslint": tsPlugin,
      },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            prefer: "type-imports",
            fixStyle: "inline-type-imports",
          },
        ],
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "no-console": "off",
        "prefer-const": "warn",
        "no-var": "error",
      },
    },
    // Ignore patterns
    {
      ignores: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "build/**",
        ".turbo/**",
        "**/*.js",
        "**/*.mjs",
        "**/*.cjs",
      ],
    },
  ];
}

// Also export the base config for direct use
export const cliConfig = createCliConfig();
