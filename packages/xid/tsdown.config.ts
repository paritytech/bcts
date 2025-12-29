import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsXid",
  outputOptions: {
    globals: {
      "@bcts/components": "bctsComponents",
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/envelope": "bctsEnvelope",
      "@bcts/known-values": "bctsKnownValues",
      "@bcts/provenance-mark": "bctsProvenanceMark",
      "@bcts/rand": "bctsRand",
      "@bcts/uniform-resources": "bctsUniformResources",
    },
  },
});
