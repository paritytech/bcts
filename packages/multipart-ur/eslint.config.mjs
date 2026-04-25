import createConfig from "@bcts/eslint";

const baseConfig = createConfig("./tsconfig.json");

export default [
  ...baseConfig,
  // CLI / Node-only files: allow Node globals.
  {
    files: ["src/bin/**/*.ts", "src/cmd/**/*.ts", "src/prores.ts", "src/svg.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "no-console": "off",
    },
  },
  // Pixel-heavy code: relax rules where tight index access is bounds-guaranteed.
  {
    files: [
      "src/animate.ts",
      "src/logo.ts",
      "src/qr-matrix.ts",
      "src/render.ts",
      "src/svg.ts",
    ],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/prefer-for-of": "off",
    },
  },
  // CLI command modules: relax string/null check rules to keep code straightforward.
  {
    files: ["src/cmd/**/*.ts", "src/bin/**/*.ts", "src/animate.ts"],
    rules: {
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  },
  // Styles helper: allow short arrow-style helpers without explicit return types.
  {
    files: ["src/cmd/styles.ts"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
