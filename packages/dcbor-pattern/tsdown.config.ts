import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsDcborPattern",
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/dcbor-parse": "bctsDcborParse",
      "@bcts/components": "bctsComponents",
      "@bcts/known-values": "bctsKnownValues",
      "@bcts/tags": "bctsTags",
    },
  },
});
