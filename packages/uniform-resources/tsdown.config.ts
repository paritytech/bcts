import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife", "cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  globalName: "bctsUniformResources",
  noExternal: ["@bcts/dcbor"],
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
    },
  },
});
