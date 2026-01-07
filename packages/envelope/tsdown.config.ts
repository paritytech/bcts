import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsEnvelope",
  outputOptions: {
    globals: {
      "@bcts/components": "bctsComponents",
      "@bcts/crypto": "bctsCrypto",
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/known-values": "bctsKnownValues",
      "@bcts/rand": "bctsRand",
      "@bcts/tags": "bctsTags",
      "@bcts/uniform-resources": "bctsUniformResources",
      pako: "pako",
    },
  },
});
