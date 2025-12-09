import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "BCXID",
  outputOptions: {
    globals: {
      "@bcts/components": "BCComponents",
      "@bcts/dcbor": "BCDcbor",
      "@bcts/envelope": "BCEnvelope",
      "@bcts/known-values": "BCKnownValues",
      "@bcts/provenance-mark": "BCProvenanceMark",
      "@bcts/rand": "BCRand",
      "@bcts/uniform-resources": "BCUR",
    },
  },
});
