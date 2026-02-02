import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsEnvelopePattern",
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/dcbor-parse": "bctsDcborParse",
      "@bcts/dcbor-pattern": "bctsDcborPattern",
      "@bcts/envelope": "bctsEnvelope",
      "@bcts/components": "bctsComponents",
      "@bcts/tags": "bctsTags",
      "@bcts/known-values": "bctsKnownValues",
    },
  },
});
