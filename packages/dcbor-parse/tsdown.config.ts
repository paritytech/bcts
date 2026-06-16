import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  dts: true,
  inputOptions: {
    // The rolldown-plugin-dts "fake-js" pass transforms .d.ts content without
    // emitting a sourcemap, producing a spurious SOURCEMAP_BROKEN warning even
    // though the real JS sourcemaps are correct. Filter only that case.
    onwarn(warning, defaultHandler) {
      if (warning.code === "SOURCEMAP_BROKEN") return;
      defaultHandler(warning);
    },
  },
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  outDir: "dist",
  target: "es2022",
  globalName: "bctsDcborParse",
  deps: {
    neverBundle: ["@bcts/dcbor", "@bcts/known-values", "@bcts/uniform-resources"],
  },
  outputOptions: {
    globals: {
      "@bcts/dcbor": "bctsDcbor",
      "@bcts/known-values": "bctsKnownValues",
      "@bcts/uniform-resources": "bctsUniformResources",
    },
  },
});
