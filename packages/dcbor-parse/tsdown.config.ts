import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  outDir: "dist",
  target: "es2022",
  globalName: "bctsDcborParse",
  external: ["@bcts/dcbor", "@bcts/known-values", "@bcts/uniform-resources"],
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/known-values": "bctsKnownValues",
      "@bcts/uniform-resources": "bctsUniformResources",
    },
  },
});
