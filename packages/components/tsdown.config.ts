import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "BCComponents",
  outputOptions: {
    globals: {
      "@bcts/crypto": "BCCrypto",
      "@bcts/dcbor": "BCDcbor",
      "@bcts/rand": "BCRand",
      "@bcts/sskr": "BCSSKR",
      "@bcts/tags": "BCTags",
      "@bcts/uniform-resources": "BCUR",
    },
  },
});
