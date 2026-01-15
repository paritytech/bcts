import createConfig from "@bcts/eslint";
import globals from "globals";

const baseConfig = createConfig("./tsconfig.json");

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow non-null assertions in specific cases (KvStore returns null or Envelope)
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Allow console for CLI tool
      "no-console": "off",
      // Relax strict boolean expressions for this package (Rust port patterns)
      "@typescript-eslint/strict-boolean-expressions": "off",
      // Allow unsafe operations for dynamic CBOR handling
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Allow template expressions with any type (for error messages)
      "@typescript-eslint/restrict-template-expressions": "off",
      // Allow unbound methods (used in Envelope API)
      "@typescript-eslint/unbound-method": "off",
      // Allow process.exit for CLI
      "no-restricted-globals": "off",
    },
  },
];
