import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "BCEnvelope",
  outputOptions: {
    globals: {
      "@bcts/components": "BCComponents",
      "@bcts/crypto": "BCCrypto",
      "@bcts/dcbor": "BCDcbor",
      "@bcts/known-values": "BCKnownValues",
      "@bcts/rand": "BCRand",
      "@bcts/uniform-resources": "BCUR",
    },
  },
});
