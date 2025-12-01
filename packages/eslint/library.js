import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { resolve } from 'node:path';

/*
 * This is a custom ESLint configuration for use with
 * TypeScript packages in the monorepo.
 *
 * This config provides shared rules for all packages.
 * Uses modern ESLint flat config format (ESLint 9+).
 *
 */

/**
 * Create a shared TypeScript ESLint configuration
 * @param {string} [tsconfigPath='./tsconfig.json'] - Path to tsconfig.json
 * @returns {Array} ESLint flat config array
 */
export default function createConfig(tsconfigPath = './tsconfig.json') {
  const project = resolve(process.cwd(), tsconfigPath);

  return [
    js.configs.recommended,
    {
      files: ['src/**/*.ts', 'tests/**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
          project,
        },
        globals: {
          // Common globals
          console: 'readonly',
          Buffer: 'readonly',
          // React globals
          React: 'readonly',
          JSX: 'readonly',
          // Node globals
          process: 'readonly',
          __dirname: 'readonly',
          __filename: 'readonly',
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        // TypeScript specific rules
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-non-null-assertion': 'warn',
        // General JavaScript rules
        'no-console': 'off',
        'prefer-const': 'warn',
        'no-var': 'error',
      },
      settings: {
        'import/resolver': {
          typescript: {
            project,
          },
        },
      },
    },
    {
      ignores: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'build/**',
        '.turbo/**',
        '**/*.js',
        '**/*.mjs',
        '**/*.cjs',
      ],
    },
  ];
}

// Also export the base config for direct use
export const baseConfig = createConfig();
