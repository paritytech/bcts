import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsLifehash",
  outputOptions: {
    globals: {
      "@bcts/components": "bctsComponents",
      "@bcts/crypto": "bctsCrypto",
      "@bcts/dcbor": "bctsDcbor",
    },
  },
});
